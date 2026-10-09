import { EyeIcon } from "lucide-react";
import './cardStory.css'

export default function CardStory({ title, like, genres, coverImage }){

    return(
        <div className=" w-46 flex flex-col items-center ">
            <div className="imgCard">
                <img src={coverImage}className="h-[12rem] w-full object-cover" />
            </div>
            <div className="title">
                <h1 className="text-2xl titleCard ">{title}</h1>
                <p className="flex flex-row items-center gap-2 text-[14px] "><span><EyeIcon size={15} color="red"/></span><span className="text-red-500">{like}</span></p>
                <p className="text-[14px]">{genres}</p>
            </div>
        </div>
    )
}