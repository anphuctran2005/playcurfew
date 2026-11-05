import { execFile } from 'child_process'
import { rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import { translateMain } from './store'

export const HIDDEN_FLAG = '--hidden'

const TASK_NAME = 'PlayCurfewAutoStart'
const UTF16_BOM = String.fromCharCode(0xfeff)

// Không qua shell: đường dẫn exe có thể chứa dấu cách, như "C:\Program Files\...".
const execFileAsync = promisify(execFile)

async function schtasks(args: string[]): Promise<void> {
  await execFileAsync('schtasks', args, { windowsHide: true })
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Dùng XML vì `schtasks /Create` không có tham số cho phần Settings. Mặc định của nó không
 * chạy khi dùng pin, nên rút sạc là lách được, còn ExecutionTimeLimit sẽ dừng app sau 3 ngày.
 */
export function buildTaskXml(exePath: string): string {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${escapeXml(exePath)}</Command>
      <Arguments>${HIDDEN_FLAG}</Arguments>
    </Exec>
  </Actions>
</Task>
`
}

async function hasTask(): Promise<boolean> {
  try {
    await schtasks(['/Query', '/TN', TASK_NAME])
    return true
  } catch {
    return false
  }
}

/**
 * Dùng Task Scheduler thay cho setLoginItemSettings: Windows bỏ qua mục khởi động của
 * exe yêu cầu quyền Admin, còn task /RL HIGHEST chạy được mà không hỏi UAC.
 */
export async function enableAdminAutoStart(): Promise<void> {
  // Khi chưa đóng gói, exe là electron.exe: tạo task sẽ trỏ sai ứng dụng.
  if (!app.isPackaged) return

  const xmlPath = join(app.getPath('temp'), `${TASK_NAME}.xml`)
  try {
    // schtasks đọc file XML theo khai báo UTF-16 ở đầu file, cần có BOM.
    await writeFile(xmlPath, `${UTF16_BOM}${buildTaskXml(app.getPath('exe'))}`, 'utf16le')
    await schtasks(['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F'])
  } catch (error) {
    console.error('Không tạo được tác vụ tự khởi động:', error)
    throw new Error(translateMain('errorAutoStartOn'), { cause: error })
  } finally {
    await rm(xmlPath, { force: true })
  }
}

export async function disableAdminAutoStart(): Promise<void> {
  if (!app.isPackaged) return

  // schtasks báo lỗi khi xóa task không tồn tại, nên kiểm tra trước.
  if (!(await hasTask())) return

  try {
    await schtasks(['/Delete', '/TN', TASK_NAME, '/F'])
  } catch (error) {
    console.error('Không xóa được tác vụ tự khởi động:', error)
    throw new Error(translateMain('errorAutoStartOff'), { cause: error })
  }
}
