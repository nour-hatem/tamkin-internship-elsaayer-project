"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Settings,
  X,
  DoorOpen,
  Rows3,
  UsersRound,
} from "lucide-react";

interface AdminSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Connected Gates",
    href: "/admin/gates",
    icon: DoorOpen,
  },
  {
    name: "Queue",
    href: "/admin/queue",
    icon: UsersRound,
  },
  // {
  //   name: "Activity Logs",
  //   href: "/admin/activity",
  //   icon: Activity,
  // },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminSidebar({
  mobileOpen,
  onClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div>
            <p className="text-lg font-bold text-gray-900">
              Toyota
            </p>
            <p className="text-xs text-gray-500">
              Smart Gate Admin
            </p>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              (item.href !== "/admin" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-red-50 text-red-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={19} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}