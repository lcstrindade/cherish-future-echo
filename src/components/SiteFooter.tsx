export function SiteFooter() {
  return (
    <footer className="border-t mt-16 py-8 px-8 text-xs text-muted-foreground">
      <div className="max-w-3xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>© 2025 Bivvo. Todos os direitos reservados. CNPJ 61.912.973/0001-91</div>
        <div className="flex gap-4">
          <a
            href="https://seguro.bivvo.com.br/termos-de-uso"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Termos de uso
          </a>
          <a
            href="https://seguro.bivvo.com.br/politica-de-privacidade"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Política de privacidade
          </a>
        </div>
      </div>
    </footer>
  );
}