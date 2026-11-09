import RichTextEditor,{RichTextEditorToolbar,RichTextEditorContent,RichTextEditorLinkBubble} from './ui/rich-text-editor'

export default function NotesRichEditor({value,onValueChange,placeholder,disabled,title,onTitleChange}:{value:string;onValueChange:(value:string)=>void;placeholder?:string;disabled?:boolean;title:string;onTitleChange:(title:string)=>void}) {
 return <RichTextEditor value={value} onValueChange={onValueChange} placeholder={placeholder} disabled={disabled}>
  {!disabled&&<RichTextEditorToolbar/>}
  <input className="notes-title-inline" aria-label="Note title" placeholder="Title" value={title} onChange={event=>onTitleChange(event.target.value)} maxLength={240} disabled={disabled}/>
  <RichTextEditorContent/>
  {!disabled&&<RichTextEditorLinkBubble/>}
 </RichTextEditor>
}
