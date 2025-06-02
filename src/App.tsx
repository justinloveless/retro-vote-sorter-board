
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Retro from "./pages/Retro";
import Teams from "./pages/Teams";
import Team from "./pages/Team";
import TeamSettings from "./pages/TeamSettings";
import Account from "./pages/Account";
import InviteAccept from "./pages/InviteAccept";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Get the base path for GitHub Pages deployment
const basename = import.meta.env.PROD ? "/retro-sort" : "";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/retro/:roomId" element={<Retro />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId" element={<Team />} />
            <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
            <Route path="/account" element={<Account />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
