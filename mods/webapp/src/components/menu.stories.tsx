import type { Meta, StoryObj } from "@storybook/react";
import { User, Globe, LogOut } from "lucide-react";
import { MenuPanel, MenuHeader, MenuDivider, MenuItem } from "./menu.js";

/** The account menu shown on the workspaces hub: account header, Profile, a language
 * switcher, and Log out. Workspace-scoped entries are intentionally absent. Rendered
 * statically here so the panel can be reviewed in isolation. */
const meta: Meta = {
  title: "Components/Account Menu",
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <MenuPanel className="w-[260px]">
      <MenuHeader initials="JS" name="Juan Soto" email="juan@cartera.com" />
      <MenuDivider />
      <MenuItem icon={User} label="Mi perfil" onClick={() => {}} />
      <div className="flex items-center justify-between gap-2.5 px-2.5 py-2">
        <span className="flex items-center gap-2.5 text-[13px] font-medium text-slate-900">
          <Globe className="h-4 w-4 text-slate-500" />
          Idioma
        </span>
        <span className="text-[13px] font-medium text-slate-500">Español</span>
      </div>
      <MenuDivider />
      <MenuItem icon={LogOut} label="Cerrar sesión" danger onClick={() => {}} />
    </MenuPanel>
  )
};
