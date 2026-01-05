// Returns today's date as "YYYY-MM-DD" format
export function getTodayDateAsString(): string {
    return new Date().toISOString().split("T")[0];
}