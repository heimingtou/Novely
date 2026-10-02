import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="flex flex-row justify-around text-xl p-4 bg-gray-800 shadow-md">
      <Link href="/" className="text-blue-400 hover:underline">Trang chủ</Link>
      <Link href="/novel/1" className="text-blue-400 hover:underline">Chuong 1</Link>
      <Link href="/novel/2" className="text-blue-400 hover:underline">Chuong 2</Link>
      <Link href="/novel/3" className="text-blue-400 hover:underline">Chuong 3</Link>
    </nav>
  );
}