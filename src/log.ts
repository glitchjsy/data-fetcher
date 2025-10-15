import chalk from "chalk";
import config from "../config.json";

class Logger {

    public info(task: string, text: string) {
        this.log(task, chalk.green("info"), text);
    }

    public warn(task: string, text: string) {
        this.log(task, chalk.yellow("warn"), text);
    }

    public error(task: string, text: string) {
        this.log(task, chalk.red("error"), text);
    }

    public trace(task: string, text: string) {
        if (config.trace) {
            console.log(`${chalk.dim("trace")}: ${chalk.dim(`[${task}]`)} ${chalk.dim(text)}`);
        }
    }

    public debug(task: string, text: string) {
        if (config.debug) {
            this.log(task, "debug", chalk.dim(text));
        }
    }

    private log(task: string, prefix: string, text: string) {
        console.log(`${prefix}: ${chalk.blue(`[${task}]`)} ${text}`);
    }
}

export default new Logger();