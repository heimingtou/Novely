


export default async function NovelDetailPage({ params }) {
  const { id } = await params;
  
  // Tìm truyện khớp với id trên URL

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
        {
            id=="1"&&<p>Chuong 1</p>
        }
         {
            id=="2"&&<p className="text-amber-300">Chuong 2</p>
        }
         {
            id=="3"&&<p className="text-amber-600">Chuong 3</p>
        }        
    </div>
  );
}