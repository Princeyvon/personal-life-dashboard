import type { ReactElement } from "react";

declare const Home: () => ReactElement;
export declare const VoiceNoteBox: (props: { onSubmit: (value: string, attachment?: unknown) => boolean | void | Promise<boolean | void>; loading?: boolean; placeholder?: string }) => ReactElement;
export default Home;
