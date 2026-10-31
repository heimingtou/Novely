'use client';
import { useI18n } from "@/components/i18n/LocaleProvider";

import { BellCheckIcon, BellIcon, ChevronDown, LogIn, LogOut, MessageCircle, PencilSparkles, SearchAlertIcon, SearchIcon, Settings, ShoppingBagIcon, ShoppingCartPlus, TextSearch, UserPen } from 'lucide-react';

import Link from 'next/link';
import logoLight from '../../../public/logo.png'
import logoDark from '../../../public/darklogo.png'
import Image from 'next/image'
import avatar from '../../../public/avarta.jpg'
import './navbar.css'
import { useEffect, useRef, useState } from 'react';
import { useDemoSession } from '@/lib/useDemoSession';
import { ThemeToggle } from '@/components/theme/SiteTheme';
import { LanguageSwitcher } from '@/components/i18n/LocaleProvider';
export default function Navbar() {
  const { t } = useI18n();
  const [open, setOpen]=useState(false)
  const [openGen, setOpenGen]=useState(false)
  const { account, signIn, signOut, ready: sessionReady } = useDemoSession()
  const login = Boolean(account)
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
    <nav className="site-navbar flex flex-row items-center text-xl text-foreground bg-card border-b border-border  justify-around w-full">
      <div className='imgContain w-26 md:w-36 '>
        <Link href="/">
          <Image src={logoLight} alt="logo" className="block dark:hidden " />
          <Image src={logoDark} alt="logo" className="hidden dark:block" />
        </Link>
      </div>
      <div className='flex flex-row justify-between gap-5 items-center w-[85%] mt-3 mb-3'>
        <div className=' navText flex flex-row justify-between items-center gap-[1rem] md:gap-[3rem]'>
          <div className='relative' ref={genreRef}>
            <button className='flex flex-row items-center ' onClick={()=>setOpenGen(!openGen)}>
            <span >{t("Điều hướng")}</span><span><ChevronDown/></span>
            </button>
            {
              openGen&&
              <div className='listGenre  absolute left-0 top-20 w-[20.5rem] md:w-120 h-100 rounded-lg shadow-xl!'>
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
            <Link href="/novel/1" ><span >{t("Thư viện")}</span></Link>
          </div>  
          
        </div>
        <div className='btn_Containt flex flex-row justify-around items-center w-[50%] gap-3 md:gap-12'>
          <Link href="/forum" className="forum-nav-link" aria-label={t("Cộng đồng")} title={t("Cộng đồng Novely")}><MessageCircle size={20} /></Link>
          <Link href="/search" className='btn_search' aria-label={t("Tìm kiếm")}>
              <TextSearch/>
          </Link>
          
          <div className='max-md:hidden flex flex-row gap-[3rem] items-center  ml-2 mr-2'>
            <Link href="/novel/2" aria-label={t("thông báo")}> <BellIcon/>  </Link>
            {!login?<button className='btn_nav ' disabled={!sessionReady} onClick={signIn}>{t("Đăng nhập")} </button>:<button className='btn_nav'>{t("Mua gói Vip")}</button>}
          </div>
          <div className='avatar relative' ref={avartaRef} onKeyDown={event => {
            if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('button')?.focus(); }
          }}>
            <button className='flex flex-row gap-1.5 items-center' aria-label={t("Menu tài khoản")} aria-expanded={open} aria-controls="account-menu" onClick={()=>setOpen(!open)}>
            <div  className='w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border focus:outline-none flex items-center justify-center cursor-pointer transition-transform active:scale-95' >
              <Image src={avatar} alt={account?.name || 'avatar'}/>
            </div>
            <ChevronDown/>
            </button>
            {open&&
            <div id="account-menu" className='account-menu absolute right-0 top-full mt-2 p-3.5 gap-3 rounded-lg shadow-xl flex flex-col items-start'>
            {login&&
             ( <>
              <span className='text-sm'>{account.name}</span>
              <button className='btn-avt'> <span><UserPen/> </span>  <span>{t("profile")}</span></button>
              <hr className='w-full'/>
              <Link href="/Writer">
                  <button className='btn-avt'> <span><PencilSparkles/></span><span>Writer</span></button>
              </Link>
            
              <div className='block md:hidden'>
                <button className='btn-avt '> <span><BellIcon/></span><span>Thông báo</span></button>
              </div>
              
               <hr className='w-full'/>
             </> ) 
            }
           
            <button className='btn-avt'><span><Settings/></span><span>{t("setting")}</span></button>
            <ThemeToggle />
            <LanguageSwitcher />
            <div className='block md:hidden'>
                {!login?<button className='block md:hidden btn-avt' disabled={!sessionReady} onClick={() => { signIn(); setOp(false); }}><span><LogIn/> </span><span>{t("Đăng nhập")}</span>
            
              </button>:<button className='btn-avt block md:hidden'><span><ShoppingCartPlus/></span><span>{t("Mua gói Vip")}</span>
              </button>}
            </div>
          
            {login&&<button className='btn-avt' onClick={() => { signOut(); setOpen(false); }}><span><LogOut/> </span><span>{t("Đăng xuất")}</span></button> }
            </div>} 
          </div>
        </div>  
      </div> 
    </nav>
  );
}
