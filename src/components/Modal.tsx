import { ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}><button className="close" type="button" onClick={onClose}>关闭</button><h2>{title}</h2>{children}</section></div>
}
