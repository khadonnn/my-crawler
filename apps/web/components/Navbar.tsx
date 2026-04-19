import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle as Darkmode } from "./Darkmode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import MyClock from "@/components/MyClock";

const Navbar = () => {
  return (
    <nav className="bg-background sticky top-0 z-10 flex items-center justify-between p-4">
      {/* LEFT */}
      {/* sidebar trigger */}
      <div className="flex items-center justify-around gap-4">
        <SidebarTrigger className="cursor-pointer" />
        <MyClock />
      </div>
      {/* RIGHT */}
      <div className="flex items-center gap-4">
        <Link href="/">Dashboard</Link>
        {/* THEME MENU */}
        <Darkmode />
        {/* USER MENU */}

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="cursor-pointer">
              <AvatarImage src="/images/avatar.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>

          {/* 2 */}
          {/* <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <SquareMenu />
                                <span className="sr-only">Dropdown</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Menu Item 1</DropdownMenuItem>
                            <DropdownMenuItem>Menu Item 2</DropdownMenuItem>
                            <DropdownMenuItem>Menu Item 3</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu> */}
        </DropdownMenu>
      </div>
    </nav>
  );
};
export default Navbar;
