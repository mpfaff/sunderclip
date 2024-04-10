/* @refresh reload */
import { render } from "solid-js/web";

import "./configs/dayjs";

import "./styles.css";
import App from "./App";

render(() => <App />, document.getElementById("root") as HTMLElement);
