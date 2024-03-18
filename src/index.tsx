/* @refresh reload */
import { render } from "solid-js/web";

import "./styles.css";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";

render(() => <App />, document.getElementById("root") as HTMLElement);

invoke("close_splashscreen");
