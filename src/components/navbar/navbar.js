'use client';
import { BellCheckIcon, BellIcon, SearchAlertIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import logoLight from '../../../public/logo.png'
import logoDark from '../../../public/darklogo.png'
import Image from 'next/image'
import avatar from '../../../public/avarta.jpg'
import './navbar.css'
import { useState } from 'react';
export default function Navbar() {
  const [open, setOpen]=useState(false)
  const [login, setLogin]=useState(true)
  return (
    <nav className="flex flex-row items-center text-xl text-foreground bg-card border-b border-border  justify-around ">
      <div className='imgContain'>
        
        <Image src={logoLight} alt="logo" className="block dark:hidden" />
       
        <Image src={logoDark} alt="logo" className="hidden dark:block" />
      </div>
      <div className='flex flex-row justify-around gap-5 items-center w-[75%] mt-3 mb-3'>
        <Link href="/">Trang chủ</Link>
        <Link href="/novel/1" >Thư viện</Link>
        <div className='flex flex-row items-center gap-3 bg-background border border-input-border h-[2.5em] w-[20em] px-3 rounded-2xl focus-within:border-primary transition-all'>
        <SearchIcon className="text-muted shrink-0" />
        <input 
          type='text' 
          placeholder='search story' 
          className='h-full w-full bg-transparent text-foreground outline-none border-none text-[18px] placeholder:text-muted'
        />
        </div>
      
        <Link href="/novel/2" > <BellIcon/>  </Link>
        {login?<button className='bg-primary hover:bg-primary-hover text-white font-medium px-4 md:px-5 py-1.5 md:py-2 rounded-full text-xs sm:text-sm md:text-base shrink-0 transition-all shadow-sm cursor-pointer whitespace-nowrap' onClick={()=>setLogin(false)}>
          Đăng nhập
        </button>:<button className='bg-primary hover:bg-primary-hover text-white font-medium px-4 md:px-5 py-1.5 md:py-2 rounded-full text-xs sm:text-sm md:text-base shrink-0 transition-all shadow-sm cursor-pointer whitespace-nowrap'>
          Mua gói Vip
        </button>}
        
        <div className='avatar relative'>
          <button className='w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border focus:outline-none flex items-center justify-center cursor-pointer transition-transform active:scale-95' onClick={()=>setOpen(!open)}>
          <Image src={avatar} alt='avatar'/>
          </button>
          {open&&
          <div className='absolute left-0 top-full mt-2 w-[9rem] p-3.5 text-[18px] gap-3 pl-3.5 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col items-start text-white'>
          <button>setting</button>
          <button> profile</button>
          <button>writer</button>
          <button>logout</button>
          </div>
          } 
        </div>
      </div> 
    </nav>
  );
}