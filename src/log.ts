import chalk from "chalk";
import config from "../config.json";

class Logger {
    public static DEBUG = config.debug;
    public static TRACE = config.trace;

    public setDebug(value: boolean) {
        Logger.DEBUG = value;
    }

    public setTrace(value: boolean) {
        Logger.TRACE = value;
    }

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
        if (Logger.TRACE) {
            console.log(`${chalk.dim("trace")}: ${chalk.dim(`[${task}]`)} ${chalk.dim(text)}`);
        }
    }

    public debug(task: string, text: string) {
        if (Logger.DEBUG) {
            this.log(task, "debug", chalk.dim(text));
        }
    }

    private log(task: string, prefix: string, text: string) {
        console.log(`${prefix}: ${chalk.blue(`[${task}]`)} ${text}`);
    }
}

export default new Logger();