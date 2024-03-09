-- init-db.sql

-- Create database and tables
CREATE DATABASE IF NOT EXISTS jokesDB;
USE jokesDB;

CREATE TABLE IF NOT EXISTS jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setup TEXT NOT NULL,
    punchline TEXT NOT NULL,
    type VARCHAR(255) NOT NULL
);

-- Insert programming-related jokes
INSERT INTO jokes (setup, punchline, type) VALUES
    ('Why do programmers prefer dark mode?', 'Because light attracts bugs.', 'Programming'),
    ('Why did the programmer quit his job?', 'He didn''t get arrays.', 'General'),
    ('How many programmers does it take to change a light bulb?', 'None, that''s a hardware problem.', 'Programming'),
    ('Why do programmers always mix up Christmas and Halloween?', 'Because Oct 31 == Dec 25.', 'Programming'),
    ('Why do programmers prefer nature?', 'It has the best algorithm: survival of the fittest.', 'General');


    -- new jokes added

    ('Why do programmers never get lost?', 'Because they always follow the algorithm.', 'Programming'),
    ('What is a programmer''s favorite place in the house?', 'The living room, because there''s a couch for support.', 'General'),
    ('Why was the JavaScript developer sad?', 'Because he didn''t "null" how to express his feelings.', 'Programming'),
    ('How do you comfort a JavaScript bug?', 'You console it.', 'Programming'),
    ('Why did the programmer go broke?', 'Because he used up all his cache.', 'General');

    

