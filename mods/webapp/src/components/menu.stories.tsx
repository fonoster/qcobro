import type { Meta, StoryObj } from "@storybook/react";
import { User, Globe, LogOut } from "lucide-react";
import { MenuPanel, MenuDivider, MenuItem } from "./menu.js";

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
    <MenuPanel className="w-[240px]">
      <MenuItem icon={User} label="Mi perfil" onClick={() => {}} />
      <div className="flex items-center justify-between gap-2.5 px-2.5 py-2">
        <span className="flex items-center gap-2.5 text-[13px] text-fg">
          <Globe className="h-4 w-4 text-fg-muted" />
          Idioma
        </span>
        <span className="text-[13px] text-fg-muted">Español ›</span>
      </div>
      <MenuDivider />
      <MenuItem icon={LogOut} label="Cerrar sesión" onClick={() => {}} />
    </MenuPanel>
  )
};
