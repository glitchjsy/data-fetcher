import { TASKS } from "../registry";

export default abstract class Task<T> {
    public name: string;

    constructor(name: string) {
        this.name = name;

        // Add to the task registry
        TASKS.push({ name });
    }

    public abstract execute(params?: any): Promise<T>;
}