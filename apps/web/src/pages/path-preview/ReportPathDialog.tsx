import { ReportReason } from '@studylog/schemas/enums';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import styles from './PathPreview.module.css';
import { reportError } from './preview.ts';

const REASONS: { value: ReportReason; label: string }[] = [
    { value: ReportReason.Spam, label: 'Spam or advertising' },
    { value: ReportReason.Inappropriate, label: 'Inappropriate content' },
    { value: ReportReason.Copyright, label: 'Copies someone else\'s work' },
    { value: ReportReason.Other, label: 'Something else' },
];

interface ReportPathDialogProps {
    pathId: string;
    /** After it was sent, with what to tell the user. */
    onSent: ( notice: string ) => void;
    onClose: () => void;
}

/**
 * Reports a community path to the admins (Figma: Dialogs › Path preview · report): a reason and, optionally, what's
 * wrong. Reporting the same path twice is refused by the API; that counts as sent.
 */
export function ReportPathDialog( { pathId, onSent, onClose }: ReportPathDialogProps ) {
    const { request } = useAuth();
    const [ reason, setReason ] = useState<ReportReason>();
    const [ details, setDetails ] = useState( '' );
    const [ reasonError, setReasonError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ sending, setSending ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !reason ) {
            setReasonError( 'Choose a reason.' );

            return;
        }

        setReasonError( undefined );
        setSending( true );
        try {
            await request( `/catalog/paths/${pathId}/reports`, {
                method: 'POST',
                body: { reason, ...( details.trim() ? { details: details.trim() } : {} ) },
            } );
            onSent( 'Thanks for telling us. An admin will review this path.' );
        } catch ( failure ) {
            if ( failure instanceof ApiError && failure.status === 409 ) {
                onSent( 'You already reported this path. An admin will review it.' );

                return;
            }
            setFormError( reportError( failure ) );
            setSending( false );
        }
    };

    return (
        <Dialog
            title="Report this path"
            description="Tell us what's wrong. An admin will review it; the author isn't told who reported it."
            onClose={onClose}
        >
            <form className={styles.reportForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <fieldset className={styles.reasons} aria-describedby={reasonError ? 'reason-error' : undefined}>
                    <legend className={form.label}>Reason</legend>
                    {REASONS.map( ( option ) => (
                        <label key={option.value} className={styles.reason}>
                            <input
                                type="radio"
                                name="reason"
                                value={option.value}
                                checked={reason === option.value}
                                onChange={() => setReason( option.value )}
                            />
                            {option.label}
                        </label>
                    ) )}
                    {reasonError && <p id="reason-error" className={form.fieldError}>{reasonError}</p>}
                </fieldset>
                <FormField field="report-details" label="Details (optional)">
                    <textarea
                        {...fieldProps( 'report-details', undefined )}
                        rows={3}
                        maxLength={2000}
                        value={details}
                        onChange={( event ) => setDetails( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={sending}>
                        {sending ? 'Sending…' : 'Send report'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
