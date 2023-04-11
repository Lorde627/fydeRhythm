import React, { useEffect, useState, useRef } from "react";
import theme from "./theme"
import { ThemeProvider } from '@mui/material/styles';
import { FormControl, FormControlLabel, Radio, RadioGroup, FormGroup, Button, Snackbar, Stack } from "@mui/material";
import * as styles from "./styles.module.less";
import "./global.css";
import Animation from "./utils/animation";
import { sendToBackground } from "@plasmohq/messaging";
import type { RimeSchema } from "~shared-types";
import FileEditorButton from "./fileEditor";

const schemaMap = [
    {
        value: "luna_pinyin_simp",
        label: "简体拼音"
    },
    {
        value: "double_pinyin_flypy",
        label: "小鹤双拼"
    },
    {
        value: "double_pinyin_mspy",
        label: "微软双拼"
    },
    {
        value: "luna_pinyin",
        label: "朙月拼音"
    },
    {
        value: "double_pinyin",
        label: "自然碼雙拼"
    },
    {
        value: "cangjie5",
        label: "倉頡五代"
    },
    {
        value: "cangjie3",
        label: "倉頡三代"
    },
];

const fuzzyMap = [
    {
        value: "derive/^([zcs])h/$1/",
        label: "zh, ch, sh => z, c, s"
    },
    {
        value: "derive/^([zcs])([^h])/$1h$2/",
        label: "z, c, s => zh, ch, sh"
    },
    {
        value: "derive/^n/l/",
        label: "n => l"
    },
    {
        value: "derive/^l/n/",
        label: "l => n"
    },
    {
        value: "derive/([ei])n$/$1ng/",
        label: "en => eng, in => ing"
    },
    {
        value: "derive/([ei])ng$/$1n/",
        label: "eng => en, ing => in"
    }
];

function OptionsPage() {
    let snackbarOpen = false;
    let snackbarText = "";

    const [engineStatus, setEngineStatus] = useState({ loading: false, loaded: false, schemaList: [] as RimeSchema[], currentSchema: "" as string });
    const [tempStatus, setTempStatus] = useState<typeof engineStatus>(null);
    const [rimeLogs, setRimeLogs] = useState<string[]>([]);
    const logTextArea = useRef<HTMLTextAreaElement>();

    async function updateRimeStatus() {
        const result = await sendToBackground({
            name: "GetEngineStatus"
        });
        setEngineStatus(result);
        if (!result.loading) {
            setTempStatus(null);
        }
    }

    async function updateRimeLogs() {
        const result = await sendToBackground({
            name: "GetRimeLogs"
        });
        setRimeLogs(result.logs);
    }

    useEffect(() => {
        // Scroll textarea to bottom on log update
        const area = logTextArea.current;
        area.scrollTop = area.scrollHeight;
    }, [rimeLogs]);

    useEffect(() => {
        // update RIME status upon loading
        updateRimeStatus();
        updateRimeLogs();

        const listener = (m, s, resp) => {
            if (m.rimeStatusChanged) {
                updateRimeStatus();
            } else if (m.rimeLog) {
                setRimeLogs(rimeLogs => [...rimeLogs, m.rimeLog]);
            }
        }
        chrome.runtime.onMessage.addListener(listener)

        return () => {
            chrome.runtime.onMessage.removeListener(listener);
        }
    }, []);

    async function loadRime() {
        await sendToBackground({
            name: "ReloadRime",
        });
    }

    async function changeSchema(id: string) {
        const newStatus = Object.assign({}, engineStatus);
        newStatus.currentSchema = id;
        setTempStatus(newStatus);
        await sendToBackground({
            name: "SetSchema",
            body: {
                id: id
            }
        });
    }

    const engineStatusDisplay = tempStatus ?? engineStatus;

    let engineStatusString: string = "未启动";
    if (tempStatus && engineStatus.loading) {
        engineStatusString = "启动中";
        snackbarText = "正在应用配置...";
        snackbarOpen = true;
    } else if (engineStatus.loading) {
        engineStatusString = "启动中";
        snackbarText = "正在启动 RIME 引擎...";
        snackbarOpen = true;
    } else if (engineStatus.loaded) {
        engineStatusString = "就绪";
    }

    return <ThemeProvider theme={theme}>
        <div className={styles.content}>
            <div className={styles.bgBlock}>
                <div className={styles.leftTop1} />
                <div className={styles.leftTop2} />
                <div className={styles.leftTop3} />
                <div className={styles.rightMid1} />
                <div className={styles.rightMid2} />
            </div>
            <div className={styles.topAnimation}>
                <Animation
                    loop={true}
                    width={500}
                    height={180}
                />
            </div>
            <div className={styles.formGroup}>
                <div className={styles.formBox}>
                    <FormControl className={styles.formControl}>
                        <div className={styles.formLabel}>RIME 引擎状态：{engineStatusString}</div>
                        <Stack spacing={2} direction="row">
                            {engineStatus.loaded && <Button variant="contained" onClick={() => loadRime()}>重新启动 RIME 引擎</Button>}
                            <FileEditorButton />
                        </Stack>
                    </FormControl>
                </div>
            </div>
            {
                engineStatusDisplay.schemaList.length > 0 &&
                <div className={styles.formGroup}>
                    <div className={styles.formBox}>
                        <FormControl className={styles.formControl}>
                            <div className={styles.formLabel}>选择输入方案</div>
                            <FormGroup>
                                <RadioGroup
                                    value={engineStatusDisplay.currentSchema}
                                    onChange={async (e) => changeSchema(e.target.value)}
                                    name="schema"
                                    row
                                >
                                    {
                                        engineStatusDisplay.schemaList.map((schema) =>
                                            <FormControlLabel
                                                control={<Radio />}
                                                value={schema.id}
                                                label={schema.name}
                                                key={"schema" + schema.id}
                                            />
                                        )
                                    }
                                </RadioGroup>
                            </FormGroup>
                        </FormControl>
                    </div>
                </div>
            }
            <div className={styles.formGroup}>
                <div className={styles.formBox}>
                    <FormControl className={styles.formControl}>
                        <div className={styles.formLabel}>RIME 引擎日志</div>
                        <textarea readOnly value={rimeLogs.join("\n")} rows={10} ref={logTextArea}></textarea>
                    </FormControl>
                </div>
            </div>

            <div className={styles.footer}>FydeOS is made possible by gentle souls with real ❤️</div>
            <Snackbar
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                open={snackbarOpen}
                autoHideDuration={3000}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                onClose={() => this.setState({ snackbarOpen: false, snackbarText: "" })}
                message={<span id="message-id">{snackbarText}</span>}
            />
        </div>
    </ThemeProvider>
}

export default OptionsPage;