import { SearchIcon } from "lucide-react";


export default function SearchPage(){
    return(
        <div>
            <div className='flex flex-row items-center gap-3 bg-background border border-input-border h-[2.5em] w-[30rem] px-3 rounded-2xl           focus-within:border-primary transition-all'>
            <SearchIcon className="text-muted shrink-0" />
            <input 
            type='text' 
            placeholder='search story' 
            className='h-full w-full bg-transparent text-foreground outline-none border-none text-[18px] placeholder:text-muted'/>
          </div>
        </div>
    )
}