"use client";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const  [ value,setvalue]   = useState("");
    const trpc = useTRPC();
    const invoke  = useMutation(trpc.invoke.mutationOptions({
      onSuccess: ()=>{
        toast.success("backgroung job started")
      }
    }));

 return (
    <div className="font-bold text-rose-500">
      <Input value={value} onChange={(e)=> setvalue(e.target.value)}/>
     <Button disabled={invoke.isPending} onClick={()=> invoke.mutate({value: value})}>
      Invoke background job
      </Button>
    </div>
  )
}

export default Page


