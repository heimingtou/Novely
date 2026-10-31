import { EyeIcon } from "lucide-react";
import './cardStory.css'
import Image from "next/image";
import Link from "next/link";

export default function CardStory({ title, like, genres, coverImage, href }){
    
    return(
        <div className="CardContaint w-full  flex flex-col items-center ">
            <div className="imgCard">
                <Image src={coverImage} className=" w-full object-cover" alt="img" />
            </div>
            <div className="content w-full">
                <h2 className="md:text-[18px] text-[35px] titleCard" title={title}>
                    {href ? <Link href={href} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{title}</Link> : title}
                </h2>
                <div className="flex flex-row items-center gap-2 ">
                    <span><EyeIcon size={15} color="red"/></span>
                    <span className="text-red-500">{like}</span>
                </div>
                
                <p className="tag  " title={genres}>{genres}</p>
            </div>
        </div>
    )
}