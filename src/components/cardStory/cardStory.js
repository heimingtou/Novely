import { EyeIcon } from "lucide-react";
import './cardStory.css'
import Image from "next/image";
import Link from "next/link";

export default function CardStory({ title, like, genres, coverImage, href }){
    
    return(
        <div className="CardContaint w-full  flex flex-col items-center ">
           <Link href={href}>
                <div className="imgCard">
                <Image src={coverImage} className=" w-full object-cover" alt="img" />
                </div>
            </Link>
            
            <div className="content w-full">
                <h2 className="md:text-[18px] text-[35px] titleCard" title={title}>
                    {title}
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