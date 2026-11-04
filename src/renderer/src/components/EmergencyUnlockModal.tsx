import { useEffect, useRef, useState } from 'react'
import { LockOpen, X } from 'lucide-react'

interface EmergencyUnlockModalProps {
  phrase: string
  onConfirm: () => void
  onClose: () => void
}

function getCharClass(typedChar: string | undefined, expectedChar: string): string {
  if (typedChar === undefined) return 'text-slate-400'
  return typedChar === expectedChar ? 'text-emerald-400' : 'rounded-sm bg-red-500/70 text-white'
}

function blockInsert(event: React.SyntheticEvent): void {
  event.preventDefault()
}

function blockPasteShortcut(event: React.KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') event.preventDefault()
}

function EmergencyUnlockModal({
  phrase,
  onConfirm,
  onClose
}: EmergencyUnlockModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Một số bộ gõ tiếng Việt sinh dấu rời (e + dấu sắc), trông giống hệt nhưng khác mã ký tự.
  const expectedChars = [...phrase.normalize('NFC')]
  const typedChars = [...input.normalize('NFC')]
  const extraChars = typedChars.slice(expectedChars.length).join('')
  const isMatch = typedChars.join('') === expectedChars.join('')

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 text-slate-100 backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">Mở khóa khẩn cấp</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-400">
        Gõ lại chính xác câu dưới đây, gồm cả dấu câu và chữ hoa/thường. Không thể dán văn bản.
      </p>

      <p className="mt-4 rounded-lg bg-slate-900 p-4 leading-relaxed whitespace-pre-wrap select-none">
        {expectedChars.map((char, index) => (
          <span key={index} className={getCharClass(typedChars[index], char)}>
            {char}
          </span>
        ))}
        {extraChars && <span className="rounded-sm bg-red-500/70 text-white">{extraChars}</span>}
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPaste={blockInsert}
        onDrop={blockInsert}
        onDragOver={blockInsert}
        onKeyDown={blockPasteShortcut}
        rows={4}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        aria-label="Gõ lại câu cam kết"
        className="mt-4 w-full resize-none rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm focus:border-sky-500 focus:outline-none"
      />

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600"
        >
          Hủy
        </button>
        <button
          type="button"
          disabled={!isMatch}
          onClick={onConfirm}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          <LockOpen className="size-4" />
          Xác nhận Mở khóa (5 phút)
        </button>
      </div>
    </dialog>
  )
}

export default EmergencyUnlockModal
