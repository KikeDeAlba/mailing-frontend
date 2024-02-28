import IconsSection from './components/icon-section/Icons-section'
import { FolderList } from './components/folder-list/folder-list'
import { MailSender } from './components/mail-sender'

export default async function Index () {
  return (
    <main
      className='flex border rounded-md h-[30rem]'
    >
      <IconsSection />
      <FolderList />
      <MailSender />
    </main>
  )
}
