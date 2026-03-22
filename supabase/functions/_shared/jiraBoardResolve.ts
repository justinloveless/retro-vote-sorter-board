/** Resolve Agile board id from team Jira settings (same strategy as get-jira-board-issues). */

export async function resolveJiraBoardId(
  baseUrl: string,
  authHeaders: Record<string, string>,
  jiraBoardId: string | null,
  projectKey: string | null,
): Promise<number | undefined> {
  const boardIdNum = parseInt(jiraBoardId || '', 10);
  const isNumericBoardId = !isNaN(boardIdNum) && String(boardIdNum) === (jiraBoardId || '').trim();
  let resolvedBoardId: number | undefined;
  if (isNumericBoardId) {
    resolvedBoardId = boardIdNum;
  } else if (projectKey) {
    try {
      const boardsRes = await fetch(
        `${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=100`,
        { headers: authHeaders },
      );
      if (boardsRes.ok) {
        const boardsData = await boardsRes.json();
        const boards = boardsData?.values || [];
        const scrumBoard = boards.find((b: { type?: string }) => b?.type === 'scrum');
        const first = scrumBoard || boards[0];
        if (first?.id) resolvedBoardId = first.id;
      }
      if (resolvedBoardId == null) {
        const allRes = await fetch(`${baseUrl}/rest/agile/1.0/board?maxResults=100&startAt=0`, { headers: authHeaders });
        if (allRes.ok) {
          const allData = await allRes.json();
          const boards = allData?.values || [];
          const pkUpper = projectKey.toUpperCase();
          const match = boards.find((b: { location?: { projectKey?: string; key?: string } }) => {
            const pk = b?.location?.projectKey || b?.location?.key;
            return pk && pk.toUpperCase() === pkUpper;
          });
          const scrumFirst = boards.find((b: { type?: string }) => b?.type === 'scrum');
          const chosen = match || scrumFirst || boards[0];
          if (chosen?.id) resolvedBoardId = chosen.id;
        }
      }
    } catch (_) {
      /* ignore */
    }
  }
  return resolvedBoardId;
}
