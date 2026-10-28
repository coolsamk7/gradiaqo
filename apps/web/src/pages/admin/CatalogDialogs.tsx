import type { LearningPathJson, ManagedItemJson, PathImportResultJson } from '@studylog/schemas';
import { CatalogStatus } from '@studylog/schemas/enums';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import type { ItemField, ItemValues } from '../my-paths/item-form.ts';
import {
    checkItem,
    emptyItem,
    fromItem,
    ITEM_FIELD_ORDER,
    itemFieldErrors,
    toItemRequest,
    toItemUpdate,
} from '../my-paths/item-form.ts';
import { ItemFields } from '../my-paths/ItemFields.tsx';
import styles from './Admin.module.css';
import { changeError } from './catalog.ts';
import { changeLines, changesSomething, importError, pathOutcome, readPathFile } from './path-import.ts';

/** Names a new official path (it starts as a draft), then opens it in the builder. */
export function NewPathDialog( { onClose }: { onClose: () => void } ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const [ title, setTitle ] = useState( '' );
    const [ description, setDescription ] = useState( '' );
    const [ titleError, setTitleError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !title.trim() ) {
            setTitleError( 'Enter a title.' );

            return;
        }

        setTitleError( undefined );
        setSaving( true );
        try {
            const path = await request<LearningPathJson>( '/admin/catalog/paths', {
                method: 'POST',
                body: { title: title.trim(), ...( description.trim() ? { description: description.trim() } : {} ) },
            } );

            void navigate( `/app/admin/catalog/paths/${path.id}` );
        } catch ( failure ) {
            setFormError( changeError( failure ) );
            setSaving( false );
        }
    };

    return (
        <Dialog title="New path" description="In the global catalog. It starts as a draft: learners see it once it's published." onClose={onClose}>
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <FormField field="path-title" label="Title" error={titleError}>
                    <input
                        {...fieldProps( 'path-title', titleError )}
                        maxLength={200}
                        autoFocus
                        value={title}
                        onChange={( event ) => setTitle( event.target.value )}
                    />
                </FormField>
                <FormField field="path-description" label="Description (optional)">
                    <textarea
                        {...fieldProps( 'path-description', undefined )}
                        rows={3}
                        value={description}
                        onChange={( event ) => setDescription( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Creating…' : 'Create path'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

interface ItemDialogProps {
    /** The item to edit; a new one (a draft) when undefined. */
    item?: ManagedItemJson;
    onSaved: () => void;
    onClose: () => void;
}

/** Creates or edits an official item: its type (fixed once created), title and details. */
export function ItemDialog( { item, onSaved, onClose }: ItemDialogProps ) {
    const { request } = useAuth();
    const [ values, setValues ] = useState<ItemValues>( () => ( item ? fromItem( item ) : emptyItem() ) );
    const [ errors, setErrors ] = useState<FieldErrors<ItemField>>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const submit = item ? 'Save changes' : 'Create item';

    useEffect( () => {
        document.getElementById( 'title' )?.focus();
    }, [] );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();

        const problems = checkItem( values );

        setErrors( problems );
        setFormError( undefined );
        if ( Object.keys( problems ).length > 0 ) {
            focusFirstError( ITEM_FIELD_ORDER, problems );

            return;
        }

        setSaving( true );
        try {
            await ( item
                ? request( `/admin/catalog/items/${item.id}`, { method: 'PATCH', body: toItemUpdate( values ) } )
                : request( '/admin/catalog/items', { method: 'POST', body: toItemRequest( values ) } ) );
            onSaved();
        } catch ( failure ) {
            const fields = failure instanceof ApiError ? itemFieldErrors( failure.fieldErrors ) : {};

            setErrors( fields );
            setFormError( Object.keys( fields ).length > 0 ? undefined : changeError( failure ) );
            focusFirstError( ITEM_FIELD_ORDER, fields );
            setSaving( false );
        }
    };

    return (
        <Dialog
            title={item ? 'Edit item' : 'New item'}
            description={item ? 'Changes show everywhere the item is used.' : 'In the global catalog. It starts as a draft.'}
            wide
            onClose={onClose}
        >
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <ItemFields
                    values={values}
                    errors={errors}
                    typeLocked={item !== undefined}
                    onChange={( change ) => setValues( ( current ) => ( { ...current, ...change } ) )}
                />
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Saving…' : submit}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

interface Checked {
    fileName: string;
    content: string;
    /** What importing would change: the dry run's answer. */
    preview: PathImportResultJson;
}

interface ImportPathDialogProps {
    /** The catalog's import endpoint, e.g. `/admin/catalog/import`. */
    url: string;
    /** The line under the title: where the path goes and how it starts. */
    description: string;
    /** Where Open path goes once the path is imported. */
    pathUrl: ( pathId: string ) => string;
    /** Said after importing a path that isn't a draft (a draft gets a note on publishing it). */
    importedNote?: string;
    /** Gets whether something was imported, so the list can be reloaded. */
    onClose: ( imported: boolean ) => void;
}

/**
 * Imports a path from a path file (content/paths/README.md), like `yarn cli catalog:import`: choosing the file shows
 * what importing it would change (a dry run), and Import makes the change. Used for the global catalog (Admin) and
 * for the user's own paths.
 */
export function ImportPathDialog( { url, description, pathUrl, importedNote, onClose }: ImportPathDialogProps ) {
    const { request } = useAuth();
    const [ checking, setChecking ] = useState<string>();
    const [ checked, setChecked ] = useState<Checked>();
    const [ problems, setProblems ] = useState<string[]>();
    const [ importing, setImporting ] = useState( false );
    const [ imported, setImported ] = useState<PathImportResultJson>();
    // The file being checked: a check that finishes after another file was chosen is ignored.
    const latest = useRef<File | undefined>( undefined );
    const close = () => onClose( imported !== undefined );

    const choose = async ( event: ChangeEvent<HTMLInputElement> ) => {
        const file = event.target.files?.[0];

        latest.current = file;
        setChecked( undefined );
        setProblems( undefined );
        if ( !file ) {
            return;
        }

        setChecking( file.name );
        try {
            const content = await readPathFile( file );
            const preview = await request<PathImportResultJson>( url, {
                method: 'POST',
                body: { content, dryRun: true },
            } );

            if ( latest.current === file ) {
                setChecked( { fileName: file.name, content, preview } );
            }
        } catch ( failure ) {
            if ( latest.current === file ) {
                setProblems( importError( failure ) );
            }
        }
        if ( latest.current === file ) {
            setChecking( undefined );
        }
    };

    const confirm = async () => {
        setImporting( true );
        setProblems( undefined );
        try {
            setImported( await request<PathImportResultJson>( url, {
                method: 'POST',
                body: { content: checked!.content },
            } ) );
        } catch ( failure ) {
            setProblems( importError( failure ) );
        }
        setImporting( false );
    };

    if ( imported ) {
        return (
            <Dialog title="Import a path" description={`From ${checked!.fileName}.`} wide onClose={close}>
                <div className={styles.dialogForm}>
                    <p className={`${form.notice} ${styles.flush}`} role="status">
                        {`Imported “${imported.path.title}”.`}
                        {imported.path.status === CatalogStatus.Draft
                            ? ' It\'s a draft: publish it when it\'s ready, and learners will see it.'
                            : importedNote && ` ${importedNote}`}
                    </p>
                    <ImportSummary result={imported} />
                    <div className={dialog.actions}>
                        <Link to={pathUrl( imported.path.id )} className={`${shared.button} ${shared.secondary}`}>
                            Open path
                        </Link>
                        <button type="button" className={`${shared.button} ${shared.primary}`} onClick={close}>Done</button>
                    </div>
                </div>
            </Dialog>
        );
    }

    const willChange = checked !== undefined && changesSomething( checked.preview );

    return (
        <Dialog
            title="Import a path"
            description={description}
            wide
            onClose={close}
        >
            <div className={styles.dialogForm}>
                <FormField field="path-file" label="Path file">
                    <input
                        {...fieldProps( 'path-file', undefined )}
                        type="file"
                        accept=".yaml,.yml"
                        autoFocus
                        onChange={( event ) => void choose( event )}
                    />
                </FormField>
                {checking && <p className={app.muted} role="status">{`Checking ${checking}…`}</p>}
                {problems && (
                    <div className={`${form.formError} ${styles.flush}`} role="alert">
                        <p className={styles.flush}>{problems[0]}</p>
                        {problems.length > 1 && (
                            <ul className={styles.problems}>
                                {problems.slice( 1 ).map( ( problem ) => <li key={problem}>{problem}</li> )}
                            </ul>
                        )}
                    </div>
                )}
                {checked && !problems && (
                    <section className={styles.importPreview} aria-label="What importing changes">
                        <ImportSummary result={checked.preview} />
                        {!willChange && (
                            <p className={app.muted}>Nothing to import: the catalog already matches this file.</p>
                        )}
                    </section>
                )}
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={close}>Cancel</button>
                    <button
                        type="button"
                        className={`${shared.button} ${shared.primary}`}
                        disabled={!willChange || importing || checking !== undefined}
                        onClick={() => void confirm()}
                    >
                        {importing ? 'Importing…' : 'Import'}
                    </button>
                </div>
            </div>
        </Dialog>
    );
}

/** The path, what happens to it, the counts, and anything to look at afterwards. */
function ImportSummary( { result }: { result: PathImportResultJson } ) {
    return (
        <div className={styles.importSummary}>
            <p className={styles.flush}>
                <strong>{result.path.title}</strong>
                <span className={app.muted}>{` (${result.path.slug}) · ${pathOutcome( result )}`}</span>
            </p>
            <ul className={styles.importCounts}>
                {changeLines( result ).map( ( line ) => <li key={line}>{line}</li> )}
            </ul>
            {result.notInFile.map( ( missing ) => (
                <p key={missing} className={`${app.muted} ${app.small}`}>{`Not in the file, kept: ${missing}. Delete it in the path if you mean to.`}</p>
            ) )}
            {result.unpublishedItems.map( ( hidden ) => (
                <p key={hidden} className={`${app.muted} ${app.small}`}>{`Not published, so learners don't see it: ${hidden}.`}</p>
            ) )}
        </div>
    );
}
