import CardStory from '../cardStory/cardStory'
import './ListStory.css'

export default function ListStory({title,DataStory}){
    return(
            <div className='Contain'>                
                    <h1 className='cat '>{title}</h1>
                    <div className='cardContain'>
                    {
                        DataStory.map((novel)=>(
                        <CardStory
                            key={novel.id}
                            title={novel.title} like={novel.likes}
                            genres={novel.genres}
                            coverImage={novel.coverImage} 
                            />
                    ))}
                    </div>       
            </div>
    )
}