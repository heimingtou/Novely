import { EyeIcon } from "lucide-react";
import './cardStory.css'
import Image from "next/image";
import Link from "next/link";

export default function CardStory({ title, like, genres, coverImage, href, badges = {} }){
    return(
        <div className="CardContaint w-full  flex flex-col items-center ">
           <Link href={href}>
                <div className="imgCard">
                    <div className="imgCard__cover">
                        <Image src={coverImage} className="imgCard__image" alt={title} fill sizes="(max-width: 825px) 38vw, 18vw" />
                        <span className="imgCard__spine" aria-hidden="true" />
                        <div className="imgCard__badges">
                            {badges.full && <span className="imgCard__badge imgCard__badge--full">FULL</span>}
                            <div className="imgCard__badge-stack">
                                {badges.age18 && <span className="imgCard__badge imgCard__badge--adult">18+</span>}
                                {badges.vip && <span className="imgCard__badge imgCard__badge--vip">VIP</span>}
                            </div>
                        </div>
                    </div>
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