'use client';

/**
 * useVoiceChat — WebRTC peer-to-peer voice chat for multiplayer mode.
 *
 * Signaling is relayed through the game-service socket.io server:
 *   client→server: voice-request, voice-offer, voice-answer, voice-ice, voice-end
 *   server→client: voice-request {from}, voice-offer {from,sdp}, voice-answer {from,sdp},
 *                  voice-ice {from,candidate}, voice-ended {from}
 *
 * Glare avoidance: the RED player is always the offerer, BLACK the answerer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Color } from '@/lib/xiangqi/types';

type CallState = 'idle' | 'ready' | 'connecting' | 'active' | 'failed';

interface UseVoiceChatArgs {
  socket: Socket | null;
  roomId: string | null;
  myColor: Color;
  enabled: boolean; // controlled by parent; when true we try to enable voice
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVoiceChat({ socket, roomId, myColor, enabled }: UseVoiceChatArgs) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteReadyRef = useRef(false);
  const enabledRef = useRef(false);
  const myColorRef = useRef<Color>(myColor);

  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  /** Flush buffered ICE candidates after the remote description is set. */
  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.currentRemoteDescription) return;
    while (pendingIceRef.current.length) {
      const cand = pendingIceRef.current.shift()!;
      try {
        await pc.addIceCandidate(cand);
      } catch (e) {
        // ignore — may arrive slightly out of order
      }
    }
  }, []);

  /** Tear down everything and reset state. */
  const teardown = useCallback(() => {
    pendingIceRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.close();
      } catch {
        /* noop */
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    remoteReadyRef.current = false;
    setCallState('idle');
    setMicOn(true);
  }, []);

  /** Create the RTCPeerConnection and wire up ICE / track handlers. */
  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (ev) => {
      if (ev.candidate && socket && roomId) {
        socket.emit('voice-ice', { roomId, candidate: ev.candidate.toJSON() });
      }
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setCallState('active');
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'disconnected') {
        if (st === 'failed') setCallState('failed');
      }
    };
    pcRef.current = pc;
    return pc;
  }, [socket, roomId]);

  /** RED-only: create an offer and send it. */
  const makeOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !socket || !roomId) return;
    try {
      setCallState('connecting');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice-offer', { roomId, sdp: offer });
    } catch (e) {
      console.error('[voice] makeOffer error:', e);
      setError('Không thể tạo cuộc gọi.');
      setCallState('failed');
    }
  }, [socket, roomId]);

  /** Enable mic + peer connection. Called when `enabled` becomes true. */
  const enable = useCallback(async () => {
    if (pcRef.current) return; // already on
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      localStreamRef.current = stream;
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setCallState('ready');
      // Announce readiness.
      if (socket && roomId) socket.emit('voice-request', { roomId });
      // If I'm RED and peer already ready, offer now.
      if (myColorRef.current === 'red' && remoteReadyRef.current) {
        await makeOffer();
      }
    } catch (e) {
      console.error('[voice] enable error:', e);
      setError('Không truy cập được micro. Hãy cấp quyền micro cho trình duyệt.');
      setCallState('failed');
      teardown();
    }
  }, [createPeer, makeOffer, roomId, socket, teardown]);

  // React to the parent toggling `enabled`.
  useEffect(() => {
    if (enabled && !pcRef.current) {
      void enable();
    } else if (!enabled && pcRef.current) {
      // tell peer we ended, then teardown
      if (socket && roomId) socket.emit('voice-end', { roomId });
      teardown();
    }
  }, [enabled, enable, roomId, socket, teardown]);

  // Wire up signaling listeners.
  useEffect(() => {
    if (!socket || !roomId) return;
    const onVoiceRequest = () => {
      remoteReadyRef.current = true;
      // If I'm RED and I'm already enabled, offer now.
      if (enabledRef.current && myColorRef.current === 'red' && pcRef.current) {
        void makeOffer();
      }
    };
    const onVoiceOffer = async (payload: { from: Color; sdp: RTCSessionDescriptionInit }) => {
      if (!enabledRef.current || !pcRef.current) return; // not ready; ignore
      try {
        setCallState('connecting');
        await pcRef.current.setRemoteDescription(payload.sdp);
        await flushIce();
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('voice-answer', { roomId, sdp: answer });
      } catch (e) {
        console.error('[voice] onVoiceOffer error:', e);
        setCallState('failed');
      }
    };
    const onVoiceAnswer = async (payload: { from: Color; sdp: RTCSessionDescriptionInit }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(payload.sdp);
        await flushIce();
      } catch (e) {
        console.error('[voice] onVoiceAnswer error:', e);
      }
    };
    const onVoiceIce = async (payload: { from: Color; candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.currentRemoteDescription) {
        pendingIceRef.current.push(payload.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
        /* ignore */
      }
    };
    const onVoiceEnded = () => {
      teardown();
    };
    socket.on('voice-request', onVoiceRequest);
    socket.on('voice-offer', onVoiceOffer);
    socket.on('voice-answer', onVoiceAnswer);
    socket.on('voice-ice', onVoiceIce);
    socket.on('voice-ended', onVoiceEnded);
    return () => {
      socket.off('voice-request', onVoiceRequest);
      socket.off('voice-offer', onVoiceOffer);
      socket.off('voice-answer', onVoiceAnswer);
      socket.off('voice-ice', onVoiceIce);
      socket.off('voice-ended', onVoiceEnded);
    };
  }, [socket, roomId, flushIce, makeOffer, teardown]);

  /** Toggle the local mic on/off (keeps the call alive). */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (socket && roomId) {
        try {
          socket.emit('voice-end', { roomId });
        } catch {
          /* noop */
        }
      }
      teardown();
    };
    // cleanup on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    micOn,
    error,
    remoteAudioRef,
    toggleMute,
  };
}
