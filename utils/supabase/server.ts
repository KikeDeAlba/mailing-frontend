'use server'

import { Database } from '@/database.types'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SendEmails from '@/utils/apicall/send'
import nodemailer from 'nodemailer'

export const createClient = () => {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get (name: string) {
          return cookieStore.get(name)?.value
        },
        set (name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove (name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        }
      }
    }
  )
}

export const addMail = async (data: FormData) => {
  const mailsArray = (data.get('mails')?.toString() ?? '').split(',')
  console.log(mailsArray)
  const folderId = data.get('folder') as string

  const supabase = createClient()

  const mailsMap = mailsArray.map((email) => ({
    email,
    folder: parseInt(folderId)
  }))

  await supabase.from('mails_saved').insert(mailsMap)

  revalidatePath('/')
  redirect('/')
}

export const getFolders = async () => {
  const supabase = createClient()
  const { data: user } = await supabase.auth.getSession()

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('owner', user.session?.user.id ?? 0)

  if (error != null) {
    console.error('Error fetching folders:', error)
    return []
  }

  const folders = data.map(async (folder) => {
    const { data } = await supabase.from('mails_saved').select('*').eq('folder', folder.id)

    return {
      ...folder,
      mails: (data ?? []).map((mail) => ({
        ...mail,
        checked: false
      }))
    }
  })

  return await Promise.all(folders)
}

export const createFolder = async (formdata: FormData) => {
  const supabase = createClient()
  const name = formdata.get('folders') as string

  const { data: user } = await supabase.auth.getSession()

  const { error } = await supabase.from('folders').insert({
    name,
    owner: user.session?.user.id
  })

  if (error != null) {
    console.error('Error creating folder:', error)
    return
  }

  revalidatePath('/')
  redirect('/')
}

export const createAcount = async (formdata: FormData) => {
  const supabase = createClient()
  const email = formdata.get('email') as string
  const password = formdata.get('password') as string

  const { data: user } = await supabase.auth.getSession()

  const getMailServer = await supabase.from('mail_server').select('*').eq('owner', user.session?.user.id ?? '')

  const mailServerID = Number(getMailServer.data?.[0].id)

  const { error } = await supabase.from('mail_accounts').insert({
    email,
    mail_server: mailServerID,
    password
  })
  console.log(email, mailServer, password)

  if (error != null) {
    console.error('Error creating account:', error)
    return
  }

  revalidatePath('/')
  redirect('/')
}

export const mailServer = async (formdata: FormData) => {
  const supabase = createClient()
  const url = formdata.get('url') as string
  const port = formdata.get('port') as string

  const { data: user } = await supabase.auth.getSession()

  const { error } = await supabase.from('mail_server').insert({
    url,
    port,
    owner: user.session?.user.id ?? ''
  })
  console.log(url, port)

  if (error != null) {
    console.error('Error creating mail server:', error)
    return
  }

  revalidatePath('/')
  redirect('/')
}

export const getServer = async () => {
  const supabase = createClient()
  const { data: user } = await supabase.auth.getSession()

  const { data, error } = await supabase
    .from('mail_server')
    .select('*')
    .eq('owner', user.session?.user.id ?? 0)

  if (error != null) {
    console.error('Error fetching mail server:', error)
    return []
  }

  return data
}

export const sendMail = async (formdata: FormData, mails: string[], selectedAccount) => {
  const supabase = createClient()

  const server = formdata.get('servers') as string
  const subject = formdata.get('subject') as string
  const account = formdata.get('account') as string
  const message = formdata.get('message') as string

  const { data: mailServer } = await supabase.from('mail_server').select('*').eq('id', server ?? '')

  const mailAccounts = await getMailAccountsWhereMailServer(Number(account))
  console.log(mailAccounts)

  const FindSelectedAccountWithClient = mailAccounts.find((account) => account.id === Number(account))

  const contacts = mails.map((mail) => mail)

  const mailProperties = {
    url: mailServer?.[0].url ?? '',
    port: mailServer?.[0].port ?? '',
    email: mailAccounts?.[0].email ?? '',
    password: mailAccounts?.[0].password ?? ''
  }

  console.log(mailProperties)

  const transporter = nodemailer.createTransport({
    host: mailProperties.url,
    port: Number(mailProperties.port),
    secure: true,
    auth: {
      user: mailProperties.email,
      pass: mailProperties.password
    }
  })

  const mailOptions = {
    from: mailProperties.email,
    to: contacts.join(','),
    subject,
    text: message
  }

  console.log(mailOptions)

  transporter.sendMail(mailOptions, (error, info) => {
    if (error != null) {
      console.error('Error sending mail:', error)
    } else {
      console.log('Mail sent:', info.response)
    }
  })

  revalidatePath('/')
  redirect('/')
}

export const getMailAccountsWhereMailServer = async (mailServerId: number) => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .eq('mail_server', mailServerId)

  if (error != null) {
    console.error('Error fetching mail accounts:', error)
    return []
  }

  return data
}
