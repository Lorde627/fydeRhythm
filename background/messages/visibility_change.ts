// Handler for VISIBILITY_CHANGE event from inputview

import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
    const visible = (req as any).visibility;
}

export default handler