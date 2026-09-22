-- 0009 used "on conflict do nothing" when creating the project-documents
-- bucket, so if it already existed (it did -- set up earlier for
-- document uploads) and wasn't already public, it never got marked
-- public. getPublicUrl() only produces a working link when the bucket
-- itself is public -- this is why the logo <img> tag rendered (with the
-- right alt text) but the image itself 404'd.
update storage.buckets set public = true where id = 'project-documents';
