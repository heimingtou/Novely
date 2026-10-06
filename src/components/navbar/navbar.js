'use client';
import { BellCheckIcon, BellIcon, SearchAlertIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import logo from '../../../public/logo.png'
import Image from 'next/image'
import avatar from '../../../public/avarta.jpg'
import './navbar.css'
import { useState } from 'react';
export default function Navbar() {
  const [open, setOpen]=useState(false)
  return (

    <nav className="flex flex-row items-center text-xl text-black bg-blue-50  justify-around">
      <div className='imgContain'>
        <Image src={logo} alt="logo"  />
      </div>
      <div className='flex flex-row justify-around gap-5 items-center w-[75%] mt-3 mb-3'>
        <Link href="/">Home</Link>
      <Link href="/novel/1" >Library</Link>
      <div className='flex flex-row items-center gap-1.5 bg-[#373a43] h-[2em] w-[20em] px-3 focus:outline-2 rounded-2xl  '>
        <SearchIcon/>
        <input type='text' placeholder='search story' className='h-full w-full rounded-2xl focus:outline-none focus:ring-0'/>
      </div>
      
      <Link href="/novel/2" > <BellIcon/>  </Link>
      <div className='avatar relative'>
        <button className='around-[5rem] overflow-hidden!' onClick={()=>setOpen(!open)}>
          <Image src={avatar} alt='avatar'/>
        </button>
        {open&&
          <div className='absolute left-0 top-full mt-2 w-[9rem] p-3.5 text-[18px] gap-3 pl-3.5 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col items-start text-white'>
          <button> profile</button>
          <button>setting</button>
          <button>writer</button>
          <button>logout</button>
        </div>
        }
        
      </div>
      
      </div>
      
    </nav>
  );
}