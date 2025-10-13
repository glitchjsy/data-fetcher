import chalk from "chalk";
import config from "../config.json";

class Logger {

    public info(text: string) {
        this.log(chalk.green("info"), text);
    }

    public warn(text: string) {
        this.log(chalk.yellow("warn"), text);
    }

    public error(text: string) {
        this.log(chalk.red("error"), text);
    }

    public debug(text: string) {
        if (config.debug) {
            this.log(chalk.gray("debug"), text);
        }
    }

    private log(prefix: string, text: string) {
        console.log(`${prefix}: ${text}`);
    }
}

export default new Logger();