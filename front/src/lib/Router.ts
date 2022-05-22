export function findRoute(): {id: string, secret: string} | null {
    const fields = window.location.href.split("/").filter((x) => x).reverse();
    try {
        if (fields[1] === "join") {
            const key = fields[1].split(",")
            return {id: key[0], secret: key[1]};
        } else {
            return null
        }
    } catch (e) { 
        return null;
    }
}