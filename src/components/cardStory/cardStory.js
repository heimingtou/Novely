import { EyeIcon } from "lucide-react";
import './cardStory.css'

export default function CardStory({ title, like, genres, coverImage }){

    return(
        <div className="CardContaint w-46 flex flex-col items-center ">
            <div className="imgCard">
                <img src={coverImage}className="h-[12rem] w-full object-cover" />
            </div>
            <div className="content">
                <div className="title">
                    <h1 className="text-2xl titleCard" title={title}>{title}</h1>
                </div>
                <p className="flex flex-row items-center gap-2 text-[14px] "><span><EyeIcon size={15} color="red"/></span><span className="text-red-500">{like}</span></p>
                <p className="tag text-[14px] " title={genres}>{genres}</p>
            </div>
        </div>
    )
}