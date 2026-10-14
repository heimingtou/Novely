import { EyeIcon } from "lucide-react";
import './cardStory.css'

export default function CardStory({ title, like, genres, coverImage }){

    return(
        <div className="CardContaint w-46 flex flex-col items-center ">
            <div className="imgCard">
                <img src={coverImage}className="h-[15rem] object-cover" alt="img"/>
            </div>
            <div className="content">
                <p className="text-[18px] titleCard" title={title}>{title}</p>
                <p className="flex flex-row items-center gap-2 "><span><EyeIcon size={15} color="red"/></span><span className="text-red-500">{like}</span></p>
                <p className="tag  " title={genres}>{genres}</p>
            </div>
        </div>
    )
}