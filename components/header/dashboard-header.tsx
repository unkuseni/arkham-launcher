"use client";
import { Separator } from "@/components/ui/separator";
import { capitalize } from "@/lib/utils";
import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { SidebarTrigger } from "../ui/sidebar";

const DashboardHeader = () => {
	const pathname = usePathname();
	const pathSegments = pathname.split("/").filter((segment) => segment);

	console.log(pathname);
	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
			<div className="flex items-center gap-2 px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						{pathSegments.map((segment, index) => {
							const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
							const isLast = index === pathSegments.length - 1;
							const displayName = capitalize(segment.replace(/-/g, " "));
							return (
								<BreadcrumbItem key={href}>
									{isLast ? (
										<BreadcrumbPage className="font-bold font-inter">
											{displayName}
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink href={href} className="font-inter">
											{displayName}
										</BreadcrumbLink>
									)}
									{!isLast && (
										<BreadcrumbSeparator className="hidden md:block mx-2 h-4" />
									)}
								</BreadcrumbItem>
							);
						})}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</header>
	);
};

export default DashboardHeader;
