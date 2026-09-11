import {ReactNode} from "react";

export default function ToolbarWrapper({children}: { children: ReactNode }) {
    return (<div className="flex w-full flex-row gap-3 my-2 p-2 border border-[#D9DDDF] shadow-sm gradient-background">
        {
            children
        }
    </div>)
}
