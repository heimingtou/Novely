
import { Eye, EyeDashedIcon, MessageCircle, StarIcon } from "lucide-react";
import Image from "next/image";
import './cardWriter.css'
export default function CardWriter({title, img, date, view, like, comment,current_chap}){
const formattedDate = new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

return(
    <div className=" ContaintCard bg-amber-50 flex flex-row justify-between h-fit gap-3.5  ">
        <div className="flex flex-row gap-4 mr-3">
             <div className="imgCard w-25 h-full relative ">
                <Image src={img} className="object-cover rounded" alt="img" />
            </div>
            <div className="title">
                <h1>{title}</h1>
                <p className="text-green-300">Số chương đã đăng: {current_chap}</p>
                <p className="text-gray-500">Cập nhật lần cuối {formattedDate}</p>
                <div className="flex flex-row justify-around gap-5">
                    <p className=" icontext"><span><Eye/> </span><span>{view}</span></p>
                    <p className="icontext"><span><StarIcon/></span><span>{like}</span></p>
                    <p className="icontext"><span><MessageCircle/></span><span>{comment}</span></p>
                </div>
            </div>
        </div>
       
        <div className="mr-3">
            <button className="btn-card"><span>Viết tiếp</span></button>
        </div>
    </div>
)
}