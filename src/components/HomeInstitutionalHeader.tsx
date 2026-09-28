/** Cabeçalho institucional TJSP (layout alinhado ao projeto NAPE). */
export function HomeInstitutionalHeader() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 md:gap-5">
      <img
        src={`${import.meta.env.BASE_URL}tjsp-logotipo-oficial.png`}
        alt="Logotipo oficial do Tribunal de Justiça do Estado de São Paulo"
        className="h-[52px] w-auto shrink-0 sm:h-[58px] lg:h-[64px]"
      />

      <div className="hidden h-10 w-px shrink-0 bg-stone-200 dark:bg-gray-600 sm:block" />

      <div className="flex min-w-0 items-center gap-3 sm:gap-4 md:gap-5">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-none text-[#ef4a3a] sm:text-[1.1rem] lg:text-[1.25rem]">
            Tribunal de Justiça
          </h1>
          <p className="mt-1 truncate text-xs leading-none text-slate-600 dark:text-gray-300 sm:text-sm lg:text-[1.05rem]">
            Estado de São Paulo
          </p>
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-stone-200 dark:bg-gray-600 md:block" />

        <div className="hidden min-w-0 items-center gap-4 md:flex lg:gap-5">
          <div className="max-w-[170px] text-sm font-semibold leading-6 text-slate-600 dark:text-gray-300 lg:text-[0.95rem]">
            A Justiça próxima
            <br />
            do cidadão
          </div>
          <div className="flex shrink-0 items-center gap-6 lg:gap-8">
            <img
              src={`${import.meta.env.BASE_URL}eproc-logo.png`}
              alt="Logotipo do eproc"
              className="h-[56px] w-auto object-contain lg:h-[68px]"
            />
            <img
              src={`${import.meta.env.BASE_URL}tjsp-atende-logo.png`}
              alt="Logotipo TJSP Atende"
              className="h-[44px] w-auto object-contain lg:h-[52px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
