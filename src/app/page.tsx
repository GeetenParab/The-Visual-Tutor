"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const Page = () => {
    const trpc = useTRPC();
    const invoke  = useMutation(trpc.invoke.mutationOptions({
      onSuccess: ()=>{
        toast.success("backgroung job started")
      }
    }));

 return (
    <div className="font-bold text-rose-500">
     <Button disabled={invoke.isPending} onClick={()=> invoke.mutate({text: "Test"})}>
      Invoke background job
      </Button>
    </div>
  )
}

export default Page


