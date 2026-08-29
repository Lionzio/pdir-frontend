/**
 * Converte uma data local para uma string ISO-8601 no fuso horário UTC,
 * forçando a hora para 00:00:00.000Z.
 *
 * Essencial para o módulo de reservas (US-06.2) para garantir que
 * offsets locais de fuso horário não alterem o dia do check-in/check-out
 * quando a data é enviada para a API.
 *
 * @param date A data local (gerada por um DatePicker, por exemplo)
 * @returns String no formato YYYY-MM-DDT00:00:00.000Z
 */
export function toUtcIso8601(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  const parsedDate = new Date(date);

  // Se for uma data inválida, retorna nulo para evitar exceções
  if (isNaN(parsedDate.getTime())) {
    return null;
  }

  // Extrai os componentes YYYY, MM, DD no fuso horário LOCAL, e constrói
  // a data UTC exata equivalente. Isso remove os efeitos do fuso local
  // (ex: Brasil UTC-3 faria a meia-noite virar 03:00 UTC do mesmo dia, ou
  // 21:00 UTC do dia anterior dependendo de como a Date() inicializou).
  const utcDate = new Date(
    Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0),
  );

  return utcDate.toISOString();
}
