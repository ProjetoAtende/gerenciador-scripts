// src/App.tsx
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import Home from "./pages/Home";
import EquipeSelectorPage from "./pages/EquipeSelectorPage";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { PresenceManager } from "./components/PresenceManager";
import { LogoutModal } from "./components/LogoutModal";

function App() {
  const { user, loading, equipeId, isLoggingOut } = useAuth();

  if (loading) return <p className="text-center p-8 dark:text-gray-300">Carregando sessão...</p>;

  if (!user) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <LoginPage />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <PresenceManager />
      <Routes>
        <Route
          path="/home"
          element={
            equipeId
              ? <Home />
              : <Navigate to="/selecionar-equipe" replace />
          }
        />
        <Route path="/selecionar-equipe" element={<EquipeSelectorPage />} />
        <Route
          path="*"
          element={
            equipeId
              ? <Navigate to="/home" replace />
              : <Navigate to="/selecionar-equipe" replace />
          }
        />
      </Routes>
      <LogoutModal isVisible={!!user && isLoggingOut} />
    </>
  );
}

export default App;
