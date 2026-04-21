"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Activity,
  CircleUserRound,
  Bot,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Database,
  FileCode2,
  LayoutDashboard,
  Plus,
  Settings,
  Shield,
  Webhook,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Datasets", url: "/datasets", icon: Database },
  { title: "Schedules", url: "/schedules", icon: Clock },
  { title: "Settings", url: "/settings", icon: Settings },
];

const AppSidebar = () => {
  const router = useRouter();
  const [runningJobsCount, setRunningJobsCount] = useState(0);
  const [proxyStatus, setProxyStatus] = useState<"ACTIVE" | "PENDING">(
    "PENDING",
  );

  useEffect(() => {
    // Fetch running jobs count
    const fetchRunningJobs = async () => {
      try {
        const response = await fetch("/api/jobs");
        if (response.ok) {
          const jobs = (await response.json()) as Array<{ status: string }>;
          const running = jobs.filter((j) => j.status === "RUNNING").length;
          setRunningJobsCount(running);
        }
      } catch (error) {
        console.error("Failed to fetch running jobs:", error);
      }
    };

    // Fetch proxy status
    const fetchProxyStatus = async () => {
      try {
        const response = await fetch("/api/proxies");
        if (response.ok) {
          const proxies = (await response.json()) as Array<{ status: string }>;
          const hasWorking = proxies.some((p) => p.status === "WORKING");
          setProxyStatus(hasWorking ? "ACTIVE" : "PENDING");
        }
      } catch (error) {
        console.error("Failed to fetch proxies:", error);
      }
    };

    fetchRunningJobs();
    fetchProxyStatus();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchRunningJobs();
      fetchProxyStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="flex items-center"
              onClick={() => router.push("/")}
            >
              <Image
                src="/images/logo.png"
                alt="logo"
                width={30}
                height={30}
                loading="eager"
                className="h-8 w-auto shrink-0 rounded-full object-cover"
              />
              <span className="font-bold tracking-wider">CRAWLER</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="inset-0 ml-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={() => router.push(item.url)}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Scraping</SidebarGroupLabel>
          <SidebarGroupAction title="Add New Crawler">
            <Plus /> <span className="sr-only">Add New Crawler</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton onClick={() => router.push("/crawlers")}>
                  <Bot />
                  My Crawlers
                </SidebarMenuButton>
                <Badge
                  variant={runningJobsCount > 0 ? "default" : "secondary"}
                  className="ml-auto rounded-full px-2 py-0"
                >
                  {runningJobsCount}{" "}
                  {runningJobsCount === 1 ? "Running" : "Running"}
                </Badge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push("/crawlers/new")}>
                  <Plus /> Create New Scraper
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Monitoring
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>

            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => router.push("/logs")}>
                      <Activity />
                      System Logs
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => router.push("/proxies")}>
                      <Shield />
                      <span>Proxies / IPs</span>
                      <Badge
                        variant={
                          proxyStatus === "ACTIVE" ? "default" : "secondary"
                        }
                        className="ml-auto rounded-full px-2 py-0"
                      >
                        {proxyStatus}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Integrations
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>

            <CollapsibleContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => router.push("/api-keys")}>
                    <FileCode2 />
                    API Keys
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => router.push("/accounts")}>
                    <CircleUserRound />
                    Accounts
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => router.push("/webhooks")}>
                    <Webhook />
                    Webhooks
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarSeparator className="inset-0 ml-0" />

      <SidebarFooter className="inset-0 rounded-md">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Image
                    src="/images/avatar.png"
                    alt="avatar"
                    width={20}
                    height={20}
                    loading="eager"
                    className="h-10 w-10 shrink-0 rounded-lg border border-gray-700/20 object-cover dark:border-gray-200/20"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Admin</span>
                    <span className="truncate text-xs text-muted-foreground">
                      admin@crawler.com
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-50">
                <DropdownMenuItem>Account</DropdownMenuItem>
                <DropdownMenuItem>Setting</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
