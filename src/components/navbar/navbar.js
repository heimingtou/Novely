'use client';
import { BellCheckIcon, BellIcon, ChevronDown, LogIn, LogOut, PencilSparkles, SearchAlertIcon, SearchIcon, Settings, ShoppingBagIcon, ShoppingCartPlus, TextSearch, UserPen } from 'lucide-react';

import Link from 'next/link';
import logoLight from '../../../public/logo.png'
import logoDark from '../../../public/darklogo.png'
import Image from 'next/image'
import avatar from '../../../public/avarta.jpg'
import './navbar.css'
import { useEffect, useRef, useState } from 'react';
export default function Navbar() {
  const [open, setOpen]=useState(false)
  const [openGen, setOpenGen]=useState(false)
  const [login, setLogin]=useState(false)
  const genreRef=useRef(null)
  const avartaRef=useRef(null)
  const genres = [
    "Ngôn Tình",
    "Đam Mỹ",
    "Bách Hợp",
    "Tiên Hiệp",
    "Kiếm Hiệp",
    "Huyền Huyễn",
    "Đô Thị",
    "Khoa Huyễn",
    "Trọng Sinh",
    "Xuyên Không",
    "Hệ Thống",
    "Trinh Thám",
    "Kinh Dị",
    "Hài Hước",
    "Trường Học",
    "Cổ Đại",
    "Mạt Thế",
    "Dinh Dưỡng",
    "Võ Luyện",
    "Lịch Sử"
];  
  useEffect(()=>{
    function handleClosePopup(event){
      if (genreRef.current && !genreRef.current.contains(event.target)) {
        setOpenGen(false);
      }
      if (avartaRef.current && !avartaRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClosePopup);
    return () => {
      document.removeEventListener('mousedown', handleClosePopup);
    };
  },[]);
  return (
    <nav className="flex flex-row items-center text-xl text-foreground bg-card border-b border-border  justify-around w-full">
      <div className='imgContain w-26 md:w-36 '>
        <Link href="/">
          <Image src={logoLight} alt="logo" className="block dark:hidden " />
          <Image src={logoDark} alt="logo" className="hidden dark:block" />
        </Link>
      </div>
      <div className='flex flex-row justify-between gap-5 items-center w-[85%] mt-3 mb-3'>
        <div className=' navText flex flex-row justify-between items-center gap-[1rem] md:gap-[3rem]'>
          <div className='relative'>
            <button className='flex flex-row items-center ' onClick={()=>setOpenGen(!openGen)}>
            <span >Điều hướng</span><span><ChevronDown/></span>   
            </button>
            {
              openGen&&
              <div className='listGenre  absolute left-0 top-20 w-[20.5rem] md:w-120 h-100 rounded-lg shadow-xl!' ref={genreRef}>
              {
                genres.map((genre)=>(
                  <Link key={genre} href={`/novel/${genre}`} >
                    <button onClick={()=>setOpenGen(false)} >{genre}</button>
                  </Link>    
                ))
              }
              </div>
            } 
          </div>
          <div>
            <Link href="/novel/1" ><span >Thư viện</span></Link>
          </div>  
          
        </div>
        <div className='btn_Containt flex flex-row justify-around items-center w-[50%] gap-12'>
          <Link href="/search" className='btn_search' >
            
              <TextSearch/>
           
          </Link>
          
          <div className='max-md:hidden flex flex-row gap-[3rem] items-center  ml-2 mr-2'>
            <Link href="/novel/2"  > <BellIcon/>  </Link> 
            {!login?<button className='btn_nav ' onClick={() =>setLogin(true)}>
            Đăng nhập
            </button>:<button className='btn_nav'>
            Mua gói Vip</button>}
          </div>
          <div className='avatar relative'>
            <button className='flex flex-row gap-1.5 items-center' onClick={()=>setOpen(!open)}>
            <div  className='w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border focus:outline-none flex items-center justify-center cursor-pointer transition-transform active:scale-95' >
              <Image src={avatar} alt='avatar'/> 
            </div>
            <ChevronDown/>
            </button>
            {open&&
            <div className='absolute right-0 top-full mt-2 w-[11rem] p-3.5 text-[18px] gap-3 pl-3.5 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col items-start text-white' ref={avartaRef}>
            {login&&
             ( <>
              <button className='btn-avt'> <span><UserPen/> </span>  <span>profile</span></button>
              <hr className='w-full'/>
              <button className='btn-avt'> <span><PencilSparkles/></span><span>writer</span></button>
              <div className='block md:hidden'>
                <button className='btn-avt '> <span><BellIcon/></span><span>thông báo</span></button>
              </div>
              
               <hr className='w-full'/>
             </> ) 
            }
           
            <button className='btn-avt'><span><Settings/></span><span>setting</span></button>
            <div className='block md:hidden'>
              {!login?<button className='btn-avt'  onClick={() =>setLogin(true)}><span><LogIn/> </span><span>Đăng nhập</span>
            
            </button>:<button className='btn-avt'><span><ShoppingCartPlus/></span><span>Mua gói Vip</span>
            </button>}
            </div>
            
            {login&&<button className='btn-avt' onClick={() =>setLogin(false)}><span><LogOut/> </span><span>logout</span></button> }
            </div>} 
          </div>
        </div>  
      </div> 
    </nav>
  );
}