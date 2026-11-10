"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon, ChevronDown, LogIn, LogOut, MessageCircle, PencilSparkles, Settings, ShoppingCartPlus, TextSearch, UserPen } from "lucide-react";
import { LanguageSwitcher, useI18n } from "@/components/i18n/LocaleProvider";
import { ThemeToggle } from "@/components/theme/SiteTheme";
import { useDemoSession } from "@/lib/useDemoSession";
import logoLight from "../../../public/logo.png";
import logoDark from "../../../public/darklogo.png";
import avatar from "../../../public/avarta.jpg";
import "./navbar.css";

const genres = [
  "Ngôn Tình", "Đam Mỹ", "Bách Hợp", "Tiên Hiệp", "Kiếm Hiệp",
  "Huyền Huyễn", "Đô Thị", "Khoa Huyễn", "Trọng Sinh", "Xuyên Không",
  "Hệ Thống", "Trinh Thám", "Kinh Dị", "Hài Hước", "Trường Học",
  "Cổ Đại", "Mạt Thế", "Dinh Dưỡng", "Võ Luyện", "Lịch Sử",
];

export default function Navbar() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openGen, setOpenGen] = useState(false);
  const { account, signIn, signOut, ready: sessionReady } = useDemoSession();
  const login = Boolean(account);
  const genreRef = useRef(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    function closePopups(event) {
      if (genreRef.current && !genreRef.current.contains(event.target)) setOpenGen(false);
      if (avatarRef.current && !avatarRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closePopups);
    return () => document.removeEventListener("mousedown", closePopups);
  }, []);

  return (
    <nav className="site-navbar flex flex-row items-center text-xl text-foreground bg-card border-b border-border justify-around w-full">
      <div className="imgContain w-26 md:w-36">
        <Link href="/">
          <Image src={logoLight} alt="logo" className="block dark:hidden" />
          <Image src={logoDark} alt="logo" className="hidden dark:block" />
        </Link>
      </div>

      <div className="flex flex-row justify-between gap-5 items-center w-[85%] mt-3 mb-3">
        <div className="navText flex flex-row justify-between items-center gap-[1rem] md:gap-[3rem]">
          <div className="relative" ref={genreRef}>
            <button type="button" className="flex flex-row items-center" aria-expanded={openGen} onClick={() => setOpenGen(!openGen)}>
              <span>{t("Điều hướng")}</span><ChevronDown />
            </button>
            {openGen && <div className="listGenre absolute left-0 top-20 w-[20.5rem] md:w-120 h-100 rounded-lg shadow-xl!">
              {genres.map((genre) => <Link key={genre} href={`/novel/${genre}`} className="btnGenre" onClick={() => setOpenGen(false)}>{genre}</Link>)}
            </div>}
          </div>
          <Link href="/library">{t("Thư viện")}</Link>
        </div>

        <div className="btn_Containt flex flex-row justify-around items-center w-[50%] gap-3 md:gap-12">
          <Link href="/forum" className="forum-nav-link" aria-label={t("Cộng đồng")} title={t("Cộng đồng Novely")}><MessageCircle size={20} /></Link>
          <Link href="/search" className="btn_search" aria-label={t("Tìm kiếm")}><TextSearch /></Link>
          <div className="max-md:hidden flex flex-row gap-[3rem] items-center ml-2 mr-2">
            <Link href="/novel/2" aria-label={t("thông báo")}><BellIcon /></Link>
            {!login
              ? <button type="button" className="btn_nav" disabled={!sessionReady} onClick={signIn}>{t("Đăng nhập")}</button>
              : <button type="button" className="btn_nav">{t("Mua gói Vip")}</button>}
          </div>

          <div className="avatar relative" ref={avatarRef} onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); event.currentTarget.querySelector("button")?.focus(); }
          }}>
            <button type="button" className="flex flex-row gap-1.5 items-center" aria-label={t("Menu tài khoản")} aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)}>
              <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border flex items-center justify-center cursor-pointer transition-transform active:scale-95">
                <Image src={avatar} alt={account?.name || "avatar"} />
              </span>
              <ChevronDown />
            </button>

            {open && <div id="account-menu" className="account-menu absolute right-0 top-full mt-2 p-3.5 gap-3 rounded-lg shadow-xl flex flex-col items-start">
              {login && <>
                <span className="text-sm">{account.name}</span>
                <button type="button" className="btn-avt w-full cursor-pointer" onClick={() => { setOpen(false); router.push("/users/minh-tho-ha"); }}><UserPen /><span>{t("profile")}</span></button>
                <hr className="w-full" />
                <Link href="/Writer" className="btn-avt" onClick={() => setOpen(false)}><PencilSparkles /><span>{t("writer")}</span></Link>
                <div className="block md:hidden"><button type="button" className="btn-avt"><BellIcon /><span>{t("thông báo")}</span></button></div>
                <hr className="w-full" />
              </>}

              <button type="button" className="btn-avt"><Settings /><span>{t("setting")}</span></button>
              <ThemeToggle />
              <LanguageSwitcher />
              <div className="block md:hidden">
                {!login
                  ? <Link href="/auth" className="btn-avt flex items-center" onClick={() => setOpen(false)}><LogIn /><span>{t("Đăng nhập")}</span></Link>
                  : <button type="button" className="btn-avt"><ShoppingCartPlus /><span>{t("Mua gói Vip")}</span></button>}
              </div>
              {login && <button type="button" className="btn-avt" onClick={() => { signOut(); setOpen(false); }}><LogOut /><span>{t("Đăng xuất")}</span></button>}
            </div>}
          </div>
        </div>
      </div>
    </nav>
  );
}
