import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabaseClient";

interface SetorRow {
  id: string;
  nome: string;
}

interface EquipeRow {
  id: string;
  nome: string;
  setor_id: string;
}

const TEAM_META: Record<string, { emoji: string; description: string; detail: string; accents: string }> = {
  "2.1": {
    emoji: "✅",
    description: "Qualidade",
    detail: "Qualidade",
    accents: "amber",
  },
  "2.2.1": {
    emoji: "🏛️",
    description: "Público Interno 1º Grau",
    detail: "Atendimento do Público Interno de 1º Grau",
    accents: "purple",
  },
  "2.2.2": {
    emoji: "🤝",
    description: "Advogados, Peritos e JusPostulandi",
    detail: "Atendimento aos Advogados, Peritos e JusPostulandi",
    accents: "purple",
  },
  "2.3.1": {
    emoji: "🏛️",
    description: "Público Interno 2º Grau",
    detail: "Atendimento do Público Interno de 2º Grau",
    accents: "blue",
  },
  "2.3.2": {
    emoji: "🤝",
    description: "Entes Conveniados (MP, DEF, PGMs)",
    detail: "Atendimento aos Entes Conveniados (MP, DEF, PGMs, etc)",
    accents: "blue",
  },
  "3.2.1": {
    emoji: "📋",
    description: "Curadoria I",
    detail: "Serviço de Curadoria I",
    accents: "green",
  },
  "3.2.2": {
    emoji: "📊",
    description: "Gestão de Curadoria II",
    detail: "Serviço de Gestão de Curadoria II",
    accents: "green",
  },
  "3.2.3": {
    emoji: "💡",
    description: "Portfólio e Inovação",
    detail: "Serviço de Gestão de Portfólio e Inovação",
    accents: "green",
  },
  "3.3": {
    emoji: "🗂️",
    description: "Núcleo de Apoio",
    detail: "Núcleo de Apoio com calendário exclusivo de Escala",
    accents: "blue",
  },
  "NAPE": {
    emoji: "🗂️",
    description: "Núcleo de Apoio",
    detail: "Núcleo de Apoio com calendário exclusivo de Escala",
    accents: "blue",
  },
};

const ACCENT_CLASSES: Record<string, string> = {
  amber: "hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700 text-amber-700 dark:text-amber-400",
  purple: "hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 text-purple-700 dark:text-purple-400",
  blue: "hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 text-blue-700 dark:text-blue-400",
  green: "hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 text-green-700 dark:text-green-400",
  gray: "hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300",
};

function buildTeamMeta(teamName: string) {
  return TEAM_META[teamName] ?? {
    emoji: "👥",
    description: teamName,
    detail: teamName,
    accents: "gray",
  };
}

export default function EquipeSelectorPage() {
  const navigate = useNavigate();
  const { setEquipeId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [setores, setSetores] = useState<SetorRow[]>([]);
  const [equipes, setEquipes] = useState<EquipeRow[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [{ data: setoresData, error: setoresError }, { data: equipesData, error: equipesError }] = await Promise.all([
          supabase.from("setores").select("id, nome").order("nome"),
          supabase.from("equipes").select("id, nome, setor_id").order("nome"),
        ]);

        if (setoresError) throw setoresError;
        if (equipesError) throw equipesError;

        if (!active) return;
        setSetores((setoresData ?? []) as SetorRow[]);
        setEquipes((equipesData ?? []) as EquipeRow[]);
      } catch (error) {
        console.error("Erro ao carregar equipes para seleção:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const setoresComEquipes = useMemo(() => {
    return setores
      .map((setor) => ({
        ...setor,
        equipes: equipes.filter((equipe) => equipe.setor_id === setor.id),
      }))
      .filter((setor) => setor.equipes.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  }, [equipes, setores]);

  const selecionarEquipe = (id: string) => {
    setEquipeId(id);
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 dark:bg-gray-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col items-center justify-center">
        <h1 className="mb-6 text-center text-2xl font-bold dark:text-gray-100">Selecione sua Equipe</h1>

        {loading && (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando equipes...
          </div>
        )}

        {!loading && setoresComEquipes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Nenhuma equipe disponível para seleção.
          </div>
        )}

        {!loading && setoresComEquipes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-8">
            {setoresComEquipes.map((setor) => (
              <div key={setor.id}>
                <h2 className="mb-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Setor {setor.nome}
                </h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {setor.equipes.map((equipe) => {
                    const meta = buildTeamMeta(equipe.nome);
                    const accentClasses = ACCENT_CLASSES[meta.accents] ?? ACCENT_CLASSES.gray;

                    return (
                      <div
                        key={equipe.id}
                        onClick={() => selecionarEquipe(equipe.id)}
                        className={`group relative w-44 cursor-pointer rounded-lg border-2 border-transparent bg-white p-4 text-center shadow-md transition hover:shadow-lg dark:bg-gray-800 ${accentClasses}`}
                      >
                        <div className="mb-1 text-2xl">{meta.emoji}</div>
                        <h3 className="mb-1 text-base font-bold">{equipe.nome}</h3>
                        {meta.description !== equipe.nome && (
                          <p className="text-xs leading-tight text-gray-600 dark:text-gray-400">{meta.description}</p>
                        )}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {meta.detail}
                          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
